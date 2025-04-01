import type { EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import type { InvokeArgs } from "@tauri-apps/api/tauri";
import { Peer, type DataConnection } from "peerjs";
import * as env from "./environment";

const peer = new Peer();
let outgoingConnections: DataConnection[] = [];
peer.on("connection", (conn) => {
    outgoingConnections.push(conn);
    conn.on("close", () => {
        const index = outgoingConnections.indexOf(conn);
        if (index >= 0) {
            outgoingConnections.splice(index, 1);
        }
    });
});
let connection: DataConnection | null = null;

// listeners for the website end
const listeners = new Map<string, EventCallback<unknown>[]>();

// events that the application is subscribed to, used for forwarding
const eventsRegisteredForForwarding = new Set<string>();

export async function getPeerId(): Promise<string> {
    if (peer.id) return peer.id;
    return new Promise((resolve) => {
        peer.once("open", () => resolve(peer.id));
    });
}

export async function connectToPeer(peerId: string): Promise<void> {
    if (connection) {
        connection.close();
    }

    let conn = (connection = peer.connect(peerId));
    conn.on("data", (_data) => {
        const data = _data as { event: string; payload: unknown };
        const eventListeners = listeners.get(data.event) || [];
        eventListeners.forEach((listener) =>
            listener({
                event: data.event,
                id: 0,
                windowLabel: "",
                payload: data.payload
            })
        );
    });

    return new Promise((resolve, reject) => {
        conn.once("open", resolve);
        conn.once("error", reject);
    });
}

function forwardEventToViewer(event: string, payload: unknown): void {
    for (const conn of outgoingConnections) {
        conn.send({ event, payload });
    }
}

export async function listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
    if (env.isApplication) {
        const { listen: tauriListen } = await import("@tauri-apps/api/event");
        if (!eventsRegisteredForForwarding.has(event)) {
            eventsRegisteredForForwarding.add(event);
            tauriListen(event, (payload) => forwardEventToViewer(event, payload.payload));
        }

        return tauriListen(event, handler);
    }

    const eventListeners = listeners.get(event) || [];
    eventListeners.push(handler as EventCallback<unknown>);
    listeners.set(event, eventListeners);

    return () => {
        const eventListeners = listeners.get(event) || [];
        const index = eventListeners.indexOf(handler as EventCallback<unknown>);
        if (index >= 0) {
            eventListeners.splice(index, 1);
        }

        if (eventListeners.length === 0) {
            listeners.delete(event);
        }
    };
}

export async function emit(event: string, payload?: unknown): Promise<void> {
    if (env.isApplication) {
        return import("@tauri-apps/api/event").then(({ emit }) => emit(event, payload));
    }

    // ignored on website
}

export async function invoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
    if (env.isApplication) {
        return import("@tauri-apps/api/tauri").then(({ invoke }) => invoke(cmd, args));
    }

    // ignored on website
    return Promise.resolve(undefined as unknown as T);
}

export async function resourceDir(): Promise<string> {
    if (env.isApplication) {
        return import("@tauri-apps/api/path").then(({ resourceDir }) => resourceDir());
    }

    return "";
}

export async function join(...paths: string[]): Promise<string> {
    if (env.isApplication) {
        return import("@tauri-apps/api/path").then(({ join }) => join(...paths));
    }

    return paths.join("/");
}

export function convertFileSrc(filePath: string, protocol?: string): string {
    if (env.isApplication) {
        return window.__TAURI__.convertFileSrc(filePath, protocol || "file");
    }

    return filePath;
}

export type { Event, EventCallback, UnlistenFn } from "@tauri-apps/api/event";
