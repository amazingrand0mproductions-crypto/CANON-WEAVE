// CANON WEAVE — Input
const modifier = (text) => {
  const result = CanonWeave("input", text)
  return { text: result.text, stop: !!result.stop }
}
modifier(text)
