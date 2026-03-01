import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const userId = (session.user as any).id;
    const pathUrl = params.path.join("/");
    
    // Pass search params
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const url = `${BACKEND_URL}/${pathUrl}${queryString}`;

    try {
        const text = await req.text();
        const body = text ? JSON.parse(text) : undefined;
        
        const headers: Record<string, string> = {
            "x-user-id": userId,
        };
        const incomingContentType = req.headers.get("Content-Type");
        if (incomingContentType) {
            headers["Content-Type"] = incomingContentType;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            ...(body !== undefined && { body: JSON.stringify(body) }),
            cache: "no-store",
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status });
    } catch (error) {
        console.error("Proxy POST Error:", error);
        return new Response(JSON.stringify({ error: "Proxy Error Failed" }), { status: 500 });
    }
}

export async function GET(req: NextRequest, props: { params: Promise<{ path: string[] }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    
    // Allow unauthorized GET requests for public data (stats, scenarios, etc.)
    // The backend will handle specific permission checks if needed.
    const userId = session?.user ? (session.user as any).id : null;
    const pathUrl = params.path.join("/");
    
    // Pass search params
    const { searchParams } = new URL(req.url);
    const queryString = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const url = `${BACKEND_URL}/${pathUrl}${queryString}`;

    try {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (userId) {
            headers["x-user-id"] = userId;
        }

        const response = await fetch(url, {
            method: "GET",
            headers,
            cache: "no-store",
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status });
    } catch (error) {
        console.error("Proxy GET Error:", error);
        return new Response(JSON.stringify({ error: "Proxy Error Failed" }), { status: 500 });
    }
}
