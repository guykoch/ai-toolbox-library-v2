import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Safety net: refresh the library snapshot on GitHub once a day even if nothing triggered it.
crons.daily("library snapshot", { hourUTC: 9, minuteUTC: 17 }, internal.snapshot.request, {});
export default crons;
