/**
 * Telegram-style direction hints vs configured Midgard monitored assets (order matters).
 * Precedence: both-in (pivot vs primary) before single-sided in/out.
 */
export function resolveSwapDirectionEmoji(
  inputAsset: string,
  outputAsset: string,
  monitoredAssets: string[],
): string {
  if (monitoredAssets.length === 0) {
    return '';
  }

  const isMonitored = (asset: string) => monitoredAssets.includes(asset);
  const inputIn = isMonitored(inputAsset);
  const outputIn = isMonitored(outputAsset);
  const primary = monitoredAssets[0];

  if (inputIn && outputIn) {
    if (outputAsset === primary) {
      return '🔄🟢';
    }
    if (inputAsset === primary) {
      return '🔄🔴';
    }
    return '🔄🟡';
  }

  if (!inputIn && outputIn) {
    return '🟢';
  }

  if (inputIn && !outputIn) {
    return '🔴';
  }

  return '';
}
