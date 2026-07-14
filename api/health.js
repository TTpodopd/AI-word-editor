const PROXY_VERSION = 5;

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    status: "ok",
    version: PROXY_VERSION,
    supportsCustomProvider: true,
    supportsWebSearch: true,
    supportsDocumentParse: true,
    supportsLatexConvert: true,
  });
};
