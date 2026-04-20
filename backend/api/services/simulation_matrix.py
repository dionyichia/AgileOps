from __future__ import annotations

import copy
from typing import Any


def _normalize_row(edges: list[tuple[str, float]]) -> list[tuple[str, float]]:
    total = sum(prob for _, prob in edges)
    if total <= 0:
        return []
    return [(dst, prob / total) for dst, prob in edges]


def _graph_from_matrix(matrix_data: dict[str, Any]) -> dict[str, list[tuple[str, float]]]:
    states = matrix_data["metadata"]["states"]
    prob_matrix = matrix_data["probability_matrix"]
    graph: dict[str, list[tuple[str, float]]] = {}
    for i, src in enumerate(states):
        row: list[tuple[str, float]] = []
        for j, dst in enumerate(states):
            prob = float(prob_matrix[i][j])
            if prob > 0:
                row.append((dst, prob))
        if row:
            graph[src] = row
    return graph


def _apply_topology_changes(graph: dict[str, list[tuple[str, float]]], topology_changes: list[dict[str, Any]]) -> dict[str, list[tuple[str, float]]]:
    adjusted = copy.deepcopy(graph)

    for change in topology_changes:
        change_type = change.get("type")

        if change_type == "collapse":
            node = change.get("node")
            if not node or node not in adjusted:
                continue
            successors = adjusted.pop(node)
            for src, edges in list(adjusted.items()):
                rewritten: list[tuple[str, float]] = []
                for dst, prob in edges:
                    if dst == node:
                        for succ, succ_prob in successors:
                            rewritten.append((succ, prob * succ_prob))
                    else:
                        rewritten.append((dst, prob))
                adjusted[src] = _normalize_row(rewritten)

        elif change_type == "add_edge":
            src = change.get("from")
            dst = change.get("to")
            prob = float(change.get("probability", 0.0))
            if not src or not dst or prob <= 0:
                continue
            existing = adjusted.get(src, [])
            scale = max(0.0, 1.0 - prob)
            adjusted[src] = _normalize_row([(edge_dst, edge_prob * scale) for edge_dst, edge_prob in existing] + [(dst, prob)])

        elif change_type == "boost_exit":
            node = change.get("node")
            delta = float(change.get("delta", 0.0))
            if not node or node not in adjusted or delta <= 0:
                continue
            edges = adjusted[node]
            if any(dst == "END" for dst, _ in edges):
                end_prob = sum(prob for dst, prob in edges if dst == "END")
                remaining = max(1e-9, 1.0 - end_prob)
                rewritten = []
                for dst, prob in edges:
                    if dst == "END":
                        rewritten.append((dst, prob + delta))
                    else:
                        rewritten.append((dst, prob * (1 - delta / remaining)))
                adjusted[node] = _normalize_row(rewritten)
            else:
                adjusted[node] = _normalize_row([(dst, prob * (1 - delta)) for dst, prob in edges] + [("END", delta)])

    return adjusted


def _matrix_from_graph(baseline: dict[str, Any], graph: dict[str, list[tuple[str, float]]], tool_features: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(baseline)
    states = list(result["metadata"]["states"])
    state_index = result["metadata"]["state_index"]

    probability_matrix = [[0.0 for _ in states] for _ in states]
    count_matrix = [[0 for _ in states] for _ in states]
    edge_list: list[dict[str, Any]] = []
    graph_payload: dict[str, list[dict[str, Any]]] = {}

    baseline_edge_lookup = {
        (edge["source"], edge["target"]): edge
        for edge in baseline.get("edge_list", [])
    }
    baseline_dwell = baseline.get("transition_dwell", {})
    edge_impact = tool_features.get("edge_impact", {})

    total_edges = 0
    for src, edges in graph.items():
        graph_payload[src] = []
        for dst, prob in _normalize_row(edges):
            total_edges += 1
            i = state_index[src]
            j = state_index[dst]
            probability_matrix[i][j] = prob
            count_matrix[i][j] = max(1, round(prob * 100))

            edge_key = f"{src},{dst}"
            baseline_edge = baseline_edge_lookup.get((src, dst))
            time_samples = list(baseline_dwell.get(edge_key, []))
            reduction = float(edge_impact.get(edge_key, 0.0))
            if reduction > 0 and time_samples:
                time_samples = [round(sample * max(0.05, 1.0 - reduction), 4) for sample in time_samples]

            graph_payload[src].append({
                "target": dst,
                "probability": prob,
                "time_samples": time_samples,
            })
            edge_list.append({
                "source": src,
                "target": dst,
                "probability": prob,
                "count": count_matrix[i][j],
                "time_stats": baseline_edge.get("time_stats") if baseline_edge else None,
            })
            if time_samples:
                result.setdefault("transition_dwell", {})[edge_key] = time_samples

    node_impact = tool_features.get("node_impact", {})
    node_durations = {}
    for node_id, samples in baseline.get("node_durations", {}).items():
        reduction = float(node_impact.get(node_id, 0.0))
        if reduction > 0:
            node_durations[node_id] = [round(sample * max(0.05, 1.0 - reduction), 4) for sample in samples]
        else:
            node_durations[node_id] = list(samples)

    top_transitions = sorted(
        (
            {"from": src, "to": dst, "count": count_matrix[state_index[src]][state_index[dst]]}
            for src, edges in graph.items()
            for dst, _ in edges
        ),
        key=lambda item: item["count"],
        reverse=True,
    )[:15]

    result["probability_matrix"] = probability_matrix
    result["count_matrix"] = count_matrix
    result["edge_list"] = edge_list
    result["graph"] = graph_payload
    result["node_durations"] = node_durations
    result["top_transitions"] = top_transitions
    result["metadata"]["non_zero_edges"] = total_edges
    result["metadata"]["note"] = f"{result['metadata'].get('note', '').rstrip()} Tool-adjusted workflow snapshot."
    return result


def build_tool_transition_matrix(baseline_matrix: dict[str, Any], tool_features: dict[str, Any]) -> dict[str, Any]:
    graph = _graph_from_matrix(baseline_matrix)
    adjusted_graph = _apply_topology_changes(graph, tool_features.get("topology_changes", []))
    return _matrix_from_graph(baseline_matrix, adjusted_graph, tool_features)


def build_workflow_diff(baseline_matrix: dict[str, Any], tool_matrix: dict[str, Any], tool_features: dict[str, Any]) -> dict[str, Any]:
    baseline_edges = {
        (edge["source"], edge["target"]): float(edge["probability"])
        for edge in baseline_matrix.get("edge_list", [])
    }
    tool_edges = {
        (edge["source"], edge["target"]): float(edge["probability"])
        for edge in tool_matrix.get("edge_list", [])
    }

    added_edges = [
        {"source": src, "target": dst, "probability": prob}
        for (src, dst), prob in tool_edges.items()
        if (src, dst) not in baseline_edges
    ]
    removed_edges = [
        {"source": src, "target": dst, "probability": prob}
        for (src, dst), prob in baseline_edges.items()
        if (src, dst) not in tool_edges
    ]
    changed_edges = [
        {
            "source": src,
            "target": dst,
            "baseline_probability": baseline_prob,
            "tool_probability": tool_edges[(src, dst)],
            "delta": round(tool_edges[(src, dst)] - baseline_prob, 4),
        }
        for (src, dst), baseline_prob in baseline_edges.items()
        if (src, dst) in tool_edges and round(tool_edges[(src, dst)] - baseline_prob, 6) != 0
    ]

    changed_nodes = [
        {"node_id": node_id, "reduction_pct": float(reduction)}
        for node_id, reduction in tool_features.get("node_impact", {}).items()
        if float(reduction) > 0
    ]

    return {
        "changed_nodes": changed_nodes,
        "added_edges": added_edges,
        "removed_edges": removed_edges,
        "changed_edges": changed_edges,
        "topology_changes": tool_features.get("topology_changes", []),
    }
