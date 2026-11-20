import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Safety net: refresh the library snapshot on GitHub once a day even if nothing triggered it.
crons.daily("library snapshot", { hourUTC: 9, minuteUTC: 17 }, internal.snapshot.request, {});
// Re-copy website libraries once a month so their prompts stay current (xyz).
crons.monthly("website prompt re-sync", { day: 3, hourUTC: 8, minuteUTC: 23 }, internal.webjobs.resyncAll, {});
export default crons;
