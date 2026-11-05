import {SITE_URL} from '~/lib/seo-urls';
import type {Route} from './+types/[robots.txt]';

export function loader({request}: Route.LoaderArgs) {
  const url = new URL(request.url);
  // Preview/dev hosts point at their own sitemap; production uses the apex.
  const origin = url.hostname.endsWith('lightboard.co.il')
    ? SITE_URL
    : url.origin;
  const body = robotsTxtData({origin});

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/**
 * AI search and answer crawlers, allowed on purpose (GEO). A named group
 * replaces the `*` group for that bot, so each group repeats the private
 * paths. Training crawlers (GPTBot, Google-Extended, Applebot-Extended,
 * CCBot) are included so brand facts reach model training; drop them here
 * if the owner objects to training use.
 */
const AI_AND_SEARCH_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'Bingbot',
  'CCBot',
];

function robotsTxtData({origin}: {origin: string}) {
  return `
User-agent: *
${generalDisallowRules()}

# AI search and assistants: allowed on purpose.
${AI_AND_SEARCH_AGENTS.map((agent) => `User-agent: ${agent}`).join('\n')}
Allow: /
${generalDisallowRules()}

# Google adsbot ignores robots.txt unless specifically named!
User-agent: adsbot-google
Disallow: /cart
Disallow: /account
Disallow: /search
Allow: /search/
Disallow: /search/?*

User-agent: Nutch
Disallow: /

User-agent: AhrefsBot
Crawl-delay: 10
${generalDisallowRules()}

User-agent: AhrefsSiteAudit
Crawl-delay: 10
${generalDisallowRules()}

User-agent: MJ12bot
Crawl-Delay: 10

User-agent: Pinterest
Crawl-delay: 1

Sitemap: ${origin}/sitemap.xml
# LLM guide: ${origin}/llms.txt
`.trim();
}

/** Paths no crawler needs: carts, accounts, search results, APIs. */
function privateDisallowRules() {
  return `Disallow: /cart
Disallow: /en/cart
Disallow: /account
Disallow: /en/account
Disallow: /checkout
Disallow: /discount/
Disallow: /search
Disallow: /en/search
Disallow: /api/
Disallow: /preview`;
}

/**
 * Shopify Online Store defaults, minus `Disallow: /policies/`: the shipping
 * and returns policies answer real buyer questions and Merchant Center
 * checks them.
 */
function generalDisallowRules() {
  return `${privateDisallowRules()}
Disallow: /collections/*sort_by*
Disallow: /*/collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: /collections/*%2b*
Disallow: /*/collections/*+*
Disallow: /*/collections/*%2B*
Disallow: /*/collections/*%2b*
Disallow: /*/collections/*filter*&*filter*
Disallow: /blogs/*+*
Disallow: /blogs/*%2B*
Disallow: /blogs/*%2b*
Disallow: /*/blogs/*+*
Disallow: /*/blogs/*%2B*
Disallow: /*/blogs/*%2b*`;
}
