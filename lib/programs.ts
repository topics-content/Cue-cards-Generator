export const PROGRAMS = ["Academy", "DSML", "AIML", "DevOps", "FDE"] as const;
export type Program = (typeof PROGRAMS)[number];
