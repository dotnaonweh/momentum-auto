// DateUtil.js
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Enable plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Format timestamp (ms) to Beijing time in yyyy-MM-dd HH:mm:ss format
 * @param {number} timestampMs - timestamp in milliseconds
 * @returns {string} formatted Beijing time string
 */
export function formatToBeijingTime(timestampMs) {
  return dayjs(timestampMs).tz("Asia/Shanghai").format("YYYY-MM-DD HH:mm:ss");
}
