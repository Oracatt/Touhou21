# 东方归名录

- Work only inside this project. D:/AIWorkspace/TS-STG is a read-only dependency source; do not change it.
- Reuse thlib's public restored player, weapons, Bomb, hitboxes, enemies, bullet/laser animation, spell settlement and presentation. Game-specific rules, story, portraits, stages, patterns, menus and music stay here.
- Original fan work, not an official Team Shanghai Alice release. Never copy a commercial game's music or a concrete original Boss/portrait. Imported common engine presets remain a private local dependency, with their existing provenance.
- Fixed integer frames and seeded RNG. Replays have an explicit game revision; deterministic changes require revision updates.
- Record completed, validated changes in focused local Git commits. Do not commit dependency copies, generated verification reports or user data.
- Use imagegen for original raster portraits/art. Save prompts and asset provenance. Inspect final images and native screenshots.
- Validate both native JS backends and gameplay/UI paths before claiming completion. Never launch a persistent interactive game unless requested.
