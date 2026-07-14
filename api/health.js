const { handleHealth } = require("../server/apiHandlers");
const { withApiHandler } = require("../server/vercelUtils");

module.exports = withApiHandler(handleHealth, { requireAuth: false });
