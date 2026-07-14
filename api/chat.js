const { handleChat } = require("../server/apiHandlers");
const { withApiHandler } = require("../server/vercelUtils");

module.exports = withApiHandler(handleChat);
