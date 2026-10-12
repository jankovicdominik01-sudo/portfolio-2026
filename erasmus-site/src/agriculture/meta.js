// Scene metadata for the build (speaker script page). No DOM is touched here.
import act1 from "./scenes/act1.js";
import act2 from "./scenes/act2.js";
import act3 from "./scenes/act3.js";
import act4 from "./scenes/act4.js";
import act5 from "./scenes/act5.js";
import backup from "./scenes/backup.js";
export const META = [...act1, ...act2, ...act3, ...act4, ...act5, ...backup].map((s) => ({ id: s.id, title: s.title, steps: s.steps || 1, loop: s.loop ?? 0, backup: !!s.backup }));
