module.exports = {
  root: true,
  parserOptions: {
    project: "./tsconfig.json"
  },
  extends: ["next", "next/core-web-vitals", "prettier"],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "@next/next/no-img-element": "off"
  }
};
