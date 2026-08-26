// CANON WEAVE — Output
const modifier = (text) => {
  const result = CanonWeave("output", text)
  return { text: result.text, stop: !!result.stop }
}
modifier(text)
