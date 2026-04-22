function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseUrlLike(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseHostLike(host) {
  try {
    return new URL(`http://${host || ""}`);
  } catch {
    return null;
  }
}

function isSplitPortFrontendOrigin(origin, frontendPort) {
  const parsedOrigin = parseUrlLike(origin);
  if (!parsedOrigin) {
    return false;
  }

  return parsedOrigin.port === String(frontendPort || "");
}

function isSameHostSplitFrontendOrigin(origin, requestHost, frontendPort) {
  const parsedOrigin = parseUrlLike(origin);
  const parsedHost = parseHostLike(requestHost);
  if (!parsedOrigin || !parsedHost) {
    return false;
  }

  return (
    parsedOrigin.hostname === parsedHost.hostname &&
    parsedOrigin.port === String(frontendPort || "")
  );
}

function resolveCorsOrigin(requestOrigin, requestHost, options = {}) {
  const frontendOrigin = trimTrailingSlash(options.frontendOrigin);
  const frontendPort = String(options.frontendPort || "");
  const normalizedRequestOrigin = trimTrailingSlash(requestOrigin);

  if (!normalizedRequestOrigin) {
    return frontendOrigin;
  }

  if (normalizedRequestOrigin === frontendOrigin) {
    return normalizedRequestOrigin;
  }

  if (isSameHostSplitFrontendOrigin(normalizedRequestOrigin, requestHost, frontendPort)) {
    return normalizedRequestOrigin;
  }

  return frontendOrigin;
}

function isAllowedSocketOrigin(origin, options = {}) {
  const frontendOrigin = trimTrailingSlash(options.frontendOrigin);
  const frontendPort = String(options.frontendPort || "");
  const normalizedOrigin = trimTrailingSlash(origin);

  if (!normalizedOrigin) {
    return true;
  }

  return (
    normalizedOrigin === frontendOrigin ||
    isSplitPortFrontendOrigin(normalizedOrigin, frontendPort)
  );
}

module.exports = {
  isAllowedSocketOrigin,
  isSameHostSplitFrontendOrigin,
  isSplitPortFrontendOrigin,
  resolveCorsOrigin
};
