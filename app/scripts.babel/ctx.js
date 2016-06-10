function makeParsable(html) {
  return html.replace(/for\s*\(\s*;\s*;\s*\)\s*;\s*/, "");
}

var parseFbRes = function(data) {
  return JSON.parse(makeParsable(data));
}
