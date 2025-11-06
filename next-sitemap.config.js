/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://thumbflip.co', // ✅ your site’s full URL (no trailing slash)
  generateRobotsTxt: true, // ✅ also generate robots.txt
  sitemapSize: 7000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: ['/private', '/admin'], // optional
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
  },
};
