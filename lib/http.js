function methodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "不支持的請求方法" });
}

function parseBody(req) {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }

  return {};
}

function safeJsonParse(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

module.exports = {
  methodNotAllowed,
  parseBody,
  safeJsonParse
};
