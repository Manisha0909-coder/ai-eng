/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare module "*.png" {
  const value: string;
  export default value;
}
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.svg";
