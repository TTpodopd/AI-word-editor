const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

function getProdBaseUrl() {
  const fromEnv =
    process.env.ADDIN_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (fromEnv) {
    const url = fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
    return url.endsWith("/") ? url : `${url}/`;
  }

  return "https://localhost:3000/";
}

const urlDev = "https://localhost:3000/";
const urlProd = getProdBaseUrl();

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    devtool: dev ? "eval-cheap-module-source-map" : "source-map",
    stats: dev ? "errors-warnings" : "normal",
    entry: {
      taskpane: ["./src/taskpane/index.tsx"],
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico|svg)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext]",
            noErrorOnMissing: true,
          },
          {
            from: "manifest*.xml",
            to: "[name][ext]",
            transform(content) {
              if (dev) return content;
              return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
            },
          },
        ],
      }),
    ],
    devServer: {
      hot: true,
      client: {
        logging: "warn",
        overlay: { errors: true, warnings: false },
      },
      devMiddleware: {
        stats: "errors-warnings",
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
      static: [
        {
          directory: path.join(__dirname, "assets"),
          publicPath: "/assets",
          watch: true,
        },
      ],
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || options.https !== undefined
          ? options.https
          : await getHttpsOptions(),
      },
      port: 3000,
      onListening: (server) => {
        const { port } = server.server.address();
        console.log(`[web] https://localhost:${port}`);
      },
      proxy: [
        {
          context: ["/api"],
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      ],
    },
  };
  return config;
};
