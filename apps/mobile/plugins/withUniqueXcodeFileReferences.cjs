"use strict";

// Xcode 27.2 rejects file references shared by groups; give each target its own Info.plist reference.
// Register BEFORE expo-sharing and expo-widgets: Expo runs same-type mods in reverse order.

const { withXcodeProject } = require("expo/config-plugins");

function splitSharedFileReferences(project) {
  const objects = project.hash.project.objects;
  const fileReferences = objects.PBXFileReference ?? {};
  const claimed = new Set();
  for (const [groupId, group] of Object.entries(objects.PBXGroup ?? {})) {
    if (groupId.endsWith("_comment") || !Array.isArray(group.children)) continue;
    group.children = group.children.map((child) => {
      if (!fileReferences[child.value]) return child;
      if (!claimed.has(child.value)) {
        claimed.add(child.value);
        return child;
      }
      const copyId = project.generateUuid();
      fileReferences[copyId] = { ...fileReferences[child.value] };
      fileReferences[`${copyId}_comment`] = fileReferences[`${child.value}_comment`];
      return { ...child, value: copyId };
    });
  }
}

module.exports = (config) =>
  withXcodeProject(config, (cfg) => {
    splitSharedFileReferences(cfg.modResults);
    return cfg;
  });
