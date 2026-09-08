import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { pwaOptions } from "./src/pwa/pwaOptions";

function getGitShortHash(): string {
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devPort = Number(env.VITE_DEV_PORT || process.env.PORT || 5175);
  const previewPort = Number(env.VITE_PREVIEW_PORT || 4173);

  const certKeyPath = "./certs/local.gotalk.dev-key.pem";
  const certPath = "./certs/local.gotalk.dev.pem";
  const certsExist = fs.existsSync(certKeyPath) && fs.existsSync(certPath);
  const useHttps = env.VITE_DEV_HTTPS === "true" && certsExist;

  const httpsConfig = useHttps
    ? { key: fs.readFileSync(certKeyPath), cert: fs.readFileSync(certPath) }
    : undefined;

  return {
    plugins: [react(), VitePWA(pwaOptions)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Force the ESM build: the package's `browser` field points to a UMD
        // bundle whose default export is the module namespace object, which
        // breaks `import Lottie from "lottie-react"` under Vite's dev optimizer.
        "lottie-react": path.resolve(
          __dirname,
          "node_modules/lottie-react/build/index.es.js"
        ),
      },
    },
    define: {
      global: "window",
      __APP_VERSION__: JSON.stringify(getGitShortHash()),
    },
    optimizeDeps: {
      exclude: ["lucide-react"],
      include: ["react", "react-dom"],
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/@][^/]*)/);
            if (!match) return;
            const pkg = match[1];

            // Plotly is its own chunk so the lazy import in PlotlyCell keeps
            // its ~4 MB off the startup critical path; chart.js stays eager
            // (admin dashboard) but is comparatively small.
            if (["plotly.js-dist-min", "react-plotly.js"].includes(pkg))
              return "plotly-vendor";
            if (["chart.js", "react-chartjs-2"].includes(pkg))
              return "chart-vendor";
            if (["lottie-react", "lottie-web"].includes(pkg)) return "lottie-vendor";
            if (pkg === "framer-motion") return "framer-motion";
            if (pkg.startsWith("@radix-ui/")) return "radix-vendor";
            if (pkg === "lucide-react") return "lucide-vendor";
          },
        },
      },
      chunkSizeWarningLimit: 2000,
    },
    server: {
      host: useHttps ? "local.gotalk.dev" : "0.0.0.0",
      port: devPort,
      strictPort: true,
      https: httpsConfig,
      proxy: {
        "/api": {
          target: "https://gotalk.dev",
          changeOrigin: true,
          secure: true,
        },
        "/whatsapp": {
          target: "https://gotalk.dev",
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: previewPort,
    },
  };
});
