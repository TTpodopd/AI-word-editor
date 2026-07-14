const { freePorts } = require("./utils/ports");

if (process.env.FAST_START === "1") {
  process.exit(0);
}

const freed = freePorts([3000, 3001], { quiet: true });
if (freed.length > 0) {
  console.log(`[start] 已释放端口 ${freed.join("、")}`);
}
