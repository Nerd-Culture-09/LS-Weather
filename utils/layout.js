/**
 * Height covered by the status bar + transparent title bar.
 * app.json sets `transparentTitle: "always"`, so the page draws underneath
 * the title bar and content has to start below it.
 */
export function getTopInset() {
  try {
    const info = my.getSystemInfoSync();
    return (info.statusBarHeight || 0) + (info.titleBarHeight || 0);
  } catch (error) {
    return 0;
  }
}
