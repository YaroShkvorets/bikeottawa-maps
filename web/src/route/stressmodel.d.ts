declare module 'stressmodel/stressmodel.js' {
  const stressmodel: {
    evaluateLTS(way: { tags: Record<string, string> }): { lts: number; message: string[]; rule?: string }
  }
  export default stressmodel
}
