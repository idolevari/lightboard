/**
 * Tiny Shopify Admin GraphQL client used by the photo upload route.
 *
 * Uses a custom app's Admin API access token (env.PRIVATE_SHOPIFY_ADMIN_API_TOKEN)
 * to upload images via the standard staged-upload + fileCreate flow:
 *
 *   1. stagedUploadsCreate -> a staging URL (Google Cloud Storage)
 *   2. POST the bytes to that URL with the returned form parameters
 *   3. fileCreate(originalSource: resourceUrl) -> Shopify File record
 *   4. poll the File until it transitions to READY and exposes its CDN URL.
 *
 * All public functions assume they're running on the server (Oxygen worker).
 */

const ADMIN_API_VERSION = '2026-04';

/**
 * @typedef {Object} AdminEnv
 * @property {string} PRIVATE_SHOPIFY_ADMIN_API_TOKEN
 * @property {string} PUBLIC_STORE_DOMAIN  e.g. kqyxee-us.myshopify.com
 */

/**
 * @param {AdminEnv} env
 */
function adminEndpoint(env) {
  return `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
}

/**
 * Run an Admin GraphQL query/mutation. Throws on transport failure or top-level
 * `errors`. Returns the `data` object.
 * @param {AdminEnv} env
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
async function adminGraphql(env, query, variables) {
  if (!env.PRIVATE_SHOPIFY_ADMIN_API_TOKEN) {
    throw new Error('PRIVATE_SHOPIFY_ADMIN_API_TOKEN is not set');
  }
  const response = await fetch(adminEndpoint(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.PRIVATE_SHOPIFY_ADMIN_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  if (!response.ok) {
    throw new Error(`admin-api-${response.status}`);
  }
  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(`admin-api-errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const STAGED_UPLOADS_CREATE = `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
        ... on MediaImage {
          image {
            url
            width
            height
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FILE_NODE_QUERY = `
  query FileNode($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image {
          url
          width
          height
        }
      }
    }
  }
`;

/**
 * @typedef {Object} UploadInput
 * @property {Blob} blob
 * @property {string} filename
 * @property {string} mimeType
 * @property {string} [alt]
 */

/**
 * @typedef {Object} UploadResult
 * @property {string} id   gid://shopify/MediaImage/...
 * @property {string} url  CDN URL (https://cdn.shopify.com/...)
 */

/**
 * Upload a single image blob to Shopify Files. Resolves with the public CDN
 * URL once the file is processed. Polls up to ~15s for processing.
 * @param {AdminEnv} env
 * @param {UploadInput} input
 * @returns {Promise<UploadResult>}
 */
export async function uploadImageToShopifyFiles(env, input) {
  const {blob, filename, mimeType, alt} = input;

  // 1. Create a staged upload target.
  const stagedData = await adminGraphql(env, STAGED_UPLOADS_CREATE, {
    input: [
      {
        resource: 'IMAGE',
        filename,
        mimeType,
        httpMethod: 'POST',
        fileSize: String(blob.size),
      },
    ],
  });
  const stagedErrors = stagedData?.stagedUploadsCreate?.userErrors ?? [];
  if (stagedErrors.length) {
    throw new Error(`staged-upload-errors: ${JSON.stringify(stagedErrors)}`);
  }
  const target = stagedData?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target?.url || !target?.resourceUrl) {
    throw new Error('staged-upload-no-target');
  }

  // 2. Upload the bytes to the staged target.
  const uploadForm = new FormData();
  for (const param of target.parameters ?? []) {
    uploadForm.append(param.name, param.value);
  }
  uploadForm.append('file', blob, filename);

  const uploadResponse = await fetch(target.url, {
    method: 'POST',
    body: uploadForm,
  });
  if (!uploadResponse.ok) {
    throw new Error(`staged-put-${uploadResponse.status}`);
  }

  // 3. Create the File record from the staged resource.
  const createData = await adminGraphql(env, FILE_CREATE, {
    files: [
      {
        alt: alt ?? '',
        contentType: 'IMAGE',
        originalSource: target.resourceUrl,
      },
    ],
  });
  const createErrors = createData?.fileCreate?.userErrors ?? [];
  if (createErrors.length) {
    throw new Error(`file-create-errors: ${JSON.stringify(createErrors)}`);
  }
  const file = createData?.fileCreate?.files?.[0];
  if (!file?.id) {
    throw new Error('file-create-no-file');
  }

  // 4. Poll until processed.
  return pollFileUntilReady(env, file.id);
}

/**
 * Poll a Shopify File node until fileStatus === READY and image.url is set.
 * Times out after ~15s, then throws.
 * @param {AdminEnv} env
 * @param {string} fileId
 * @returns {Promise<UploadResult>}
 */
async function pollFileUntilReady(env, fileId) {
  const maxAttempts = 30;
  const intervalMs = 500;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const data = await adminGraphql(env, FILE_NODE_QUERY, {id: fileId});
    const node = data?.node;
    if (node?.fileStatus === 'READY' && node?.image?.url) {
      return {id: fileId, url: node.image.url};
    }
    if (node?.fileStatus === 'FAILED') {
      throw new Error(`file-processing-failed-${fileId}`);
    }
    await sleep(intervalMs);
  }
  throw new Error(`file-poll-timeout-${fileId}`);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
