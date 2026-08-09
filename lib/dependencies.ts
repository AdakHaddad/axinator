import type { ParsedModule, DependencyGraph } from './types';

export function buildDependencyGraph(parsedModules: ParsedModule[]): DependencyGraph {
  const modules = new Map<string, ParsedModule>();
  const missingDeps = new Map<string, string[]>();

  // Map all known modules
  for (const mod of parsedModules) {
    // Note: If multiple files define the same module, the last one overwrites.
    // In a full implementation, we might want to flag duplicate module definitions as an error.
    modules.set(mod.moduleName, mod);
  }

  // Calculate in-degrees for top module candidates
  const inDegree = new Map<string, number>();
  for (const name of modules.keys()) {
    inDegree.set(name, 0);
  }

  // Populate edges and track missing dependencies
  for (const mod of parsedModules) {
    const missing = new Set<string>();
    for (const instName of mod.instantiations) {
      if (modules.has(instName)) {
        // Known dependency
        inDegree.set(instName, (inDegree.get(instName) || 0) + 1);
      } else {
        // Missing dependency
        missing.add(instName);
      }
    }
    if (missing.size > 0) {
      missingDeps.set(mod.moduleName, Array.from(missing));
    }
  }

  // Find top candidates (in-degree 0)
  const topCandidates: string[] = [];
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) {
      topCandidates.push(name);
    }
  }

  return {
    modules,
    topCandidates,
    missingDeps
  };
}

/**
 * Returns the set of all filenames that are reachable from the given top module.
 * If includeAll is true, returns all filenames from the graph.
 */
export function getRequiredFiles(
  topModuleName: string,
  graph: DependencyGraph,
  includeAll: boolean
): Set<string> {
  const requiredFiles = new Set<string>();
  
  if (includeAll) {
    for (const mod of graph.modules.values()) {
      requiredFiles.add(mod.filename);
    }
    return requiredFiles;
  }

  const visited = new Set<string>();
  const queue = [topModuleName];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const mod = graph.modules.get(current);
    if (mod) {
      requiredFiles.add(mod.filename);
      for (const inst of mod.instantiations) {
        if (graph.modules.has(inst)) {
          queue.push(inst);
        }
      }
    }
  }

  return requiredFiles;
}
