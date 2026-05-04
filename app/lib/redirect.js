import {redirect} from 'react-router';

/**
 * True if `value` is a safe same-origin path to use as a redirect target.
 * Rejects non-strings, empty strings, anything not starting with a single '/',
 * any value containing a backslash (browsers normalize '\' to '/' in http(s)
 * URLs, turning '/\host' into protocol-relative '//host'), and any value that
 * resolves to a different origin than the request.
 *
 * @param {unknown} value
 * @param {Request | string} request
 * @returns {boolean}
 */
export function isSameOriginPath(value, request) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  try {
    const baseOrigin = new URL(
      typeof request === 'string' ? request : request.url,
    ).origin;
    return new URL(value, baseOrigin).origin === baseOrigin;
  } catch {
    return false;
  }
}

/**
 * @param {Request} request
 * @param {...Array<{
 *     handle: string;
 *     data: {handle: string} & unknown;
 *   }>} [localizedResources]
 */
export function redirectIfHandleIsLocalized(request, ...localizedResources) {
  const url = new URL(request.url);
  let shouldRedirect = false;

  localizedResources.forEach(({handle, data}) => {
    if (handle !== data.handle) {
      url.pathname = url.pathname.replace(handle, data.handle);
      shouldRedirect = true;
    }
  });

  if (shouldRedirect) {
    throw redirect(url.toString());
  }
}
