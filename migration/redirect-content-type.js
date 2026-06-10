// Contentful migration: creates the Redirect content type
// Run with: npx contentful-migration --space-id SPACE_ID --access-token CMA_TOKEN migration/redirect-content-type.js
//
// Contentful provides this sample code solely to demonstrate a technical scenario.
// Any and all sample code provided by Contentful is not intended for production use.
// Contentful is not responsible for maintaining or supporting this sample code.

module.exports = function (migration) {
  const redirect = migration.createContentType("redirect", {
    name: "Redirect",
    description: "Maps an old URL path to a new one. Published entries are picked up by the webhook handler.",
    displayField: "from",
  });

  redirect.createField("from", {
    name: "From (old path)",
    type: "Symbol",
    required: true,
    validations: [
      {
        regexp: { pattern: "^\\/", flags: null },
        message: "Must start with /",
      },
    ],
  });

  redirect.createField("to", {
    name: "To (new path or URL)",
    type: "Symbol",
    required: true,
    validations: [
      {
        regexp: { pattern: "^\\/|^https?:\\/\\/", flags: null },
        message: "Must start with / or http(s)://",
      },
    ],
  });

  redirect.createField("isPermanent", {
    name: "Permanent redirect?",
    type: "Boolean",
    required: false,
    defaultValue: { "en-US": true },
  });

  redirect.changeFieldControl("from", "builtin", "singleLine", {
    helpText: "The old path, e.g. /blog/old-post-title",
  });

  redirect.changeFieldControl("to", "builtin", "singleLine", {
    helpText: "The new path or full URL, e.g. /blog/new-post-title",
  });

  redirect.changeFieldControl("isPermanent", "builtin", "boolean", {
    helpText: "Permanent (308) is correct for slug renames. Use temporary (307) for seasonal or A/B redirects.",
    trueLabel: "Permanent (308)",
    falseLabel: "Temporary (307)",
  });
};
