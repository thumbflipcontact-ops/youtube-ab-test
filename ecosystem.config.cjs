module.exports = {
  apps: [
    {
      name: "abtest-rotation",
      script: "server/scheduler.js",
      interpreter: "node",
      watch: false
    },
    {
      name: "abtest-analytics",
      script: "server/serverAnalyticsCron.js",
      interpreter: "node",
      watch: false
    }
  ]
};
