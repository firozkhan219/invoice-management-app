import nextVitals from "eslint-config-next/core-web-vitals";

const config = [...nextVitals, { ignores: ["dist/**", "tmp/**"] }];

export default config;
