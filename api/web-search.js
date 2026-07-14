const { handleWebSearch } = require("../server/apiHandlers");
const { withApiHandler } = require("../server/vercelUtils");

module.exports = withApiHandler(handleWebSearch);
