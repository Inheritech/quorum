import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "Remove disconnected participants",
  { seconds: 30 },
  internal.cleanup.presence,
  {},
);
crons.interval(
  "Delete expired session data",
  { minutes: 5 },
  internal.cleanup.sweep,
  {},
);
export default crons;
