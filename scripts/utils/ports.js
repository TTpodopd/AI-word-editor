const { execSync } = require("child_process");

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore", shell: true });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function collectPortPidsWindows(ports) {
  const portSet = new Set(ports.map(String));
  const pidsByPort = new Map(ports.map((port) => [port, new Set()]));

  try {
    const result = execSync("netstat -ano -p tcp", { encoding: "utf8", shell: true });
    result.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("TCP")) return;

      const match = trimmed.match(/^TCP\s+\S+:(\d+)\s+\S+\s+(\S+)\s+(\d+)\s*$/i);
      if (!match) return;

      const port = Number(match[1]);
      const state = match[2];
      const pid = match[3];
      if (!portSet.has(String(port)) || state !== "LISTENING") return;
      if (pid && pid !== "0") {
        pidsByPort.get(port)?.add(pid);
      }
    });
  } catch {
    // ignore
  }

  return pidsByPort;
}

function collectPortPidsUnix(port) {
  const pids = new Set();
  try {
    const result = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    result
      .split("\n")
      .map((pid) => pid.trim())
      .filter((pid) => pid && pid !== String(process.pid))
      .forEach((pid) => pids.add(pid));
  } catch {
    // port not in use
  }
  return pids;
}

/** @returns {number[]} ports that were freed */
function freePorts(ports, options = {}) {
  const { quiet = true, excludePid = process.pid } = options;
  const freed = [];

  if (process.platform === "win32") {
    const pidsByPort = collectPortPidsWindows(ports);
    for (const port of ports) {
      let killed = false;
      pidsByPort.get(port)?.forEach((pid) => {
        if (String(pid) === String(excludePid)) return;
        if (killPid(pid)) killed = true;
      });
      if (killed) {
        freed.push(port);
        if (!quiet) console.log(`[ports] 已释放端口 ${port}`);
      }
    }
    return freed;
  }

  for (const port of ports) {
    let killed = false;
    collectPortPidsUnix(port).forEach((pid) => {
      if (String(pid) === String(excludePid)) return;
      if (killPid(pid)) killed = true;
    });
    if (killed) {
      freed.push(port);
      if (!quiet) console.log(`[ports] 已释放端口 ${port}`);
    }
  }

  return freed;
}

module.exports = { freePorts };
