import type { ReqMethod, RequestProtocol } from "./types";
import { type SchemaInterface, tsv } from "@typescript-utils/schema-validator";
import type { JSON as JsonV } from "@typescript-utils/helpertypes";
import { isNullish, mapStatus } from "./utils";



const buildURI = (protocol: RequestProtocol, URIPath: string): string => `${protocol}${URIPath}`;
const createError = (message: string, uri: string) => (`[@typescript-utils/typed-webreq - ${new Date().toISOString().split(".")[0]}]: An error occured while attempting to fetch data from ${uri}: ${message}`);

interface WebReqMetadataInterface {
    method?: ReqMethod;
    api: {
        protocol: RequestProtocol;
        domain?: string;
        path: string;
    };
    returnValue?: SchemaInterface;
    body?: BodyInit;
};

interface WebReqSuccessfulReturnInterface {
        status: {
            code: number,
            text: string
        },
        jsonBody: JsonV | null,
        headers: Headers,
        ok: boolean
    }

export default async function webreq(metadata: WebReqMetadataInterface): Promise<WebReqSuccessfulReturnInterface> {
    const reqURI = buildURI(metadata.api.protocol, `${metadata.api.domain ?? ""}${metadata.api.path}`);
    if(metadata.api.protocol.startsWith("http") && isNullish(metadata.api.domain)) throw new Error(createError(`HTTP / HTTPS requests always require a domain.`, reqURI));
    const schema = metadata.returnValue ? tsv.defineSchema(`${metadata.method} ${reqURI}`, metadata.returnValue, "english") : null;
    let req;
    try {
        req = await fetch(reqURI, {
        body: metadata.body ?? null,
        method: metadata.method ?? "GET"
        });
    } catch(e) {
        throw new Error(createError("Following error occured while attempting request: "+JSON.stringify(e), reqURI));
    }
    const contentType = req.headers.get("content-type");
    let jsonBody: JsonV | null = null;

    try {
      jsonBody = await req.json();
    } catch {
      jsonBody = null;
    }
    if(!req.ok) throw new Error(createError(`Server${!metadata.api.domain ? "" : " at "+metadata.api.domain} returned HTTP Status "${req.status} - ${mapStatus(req.status.toString())}"`, reqURI));
    if(contentType?.includes("application/json") && isNullish(jsonBody)) throw createError(`Header "Content-Type" is "application/json" but JSON Body is nonexistent.`, reqURI);
    if (contentType?.includes("application/json")) {
        const validation = schema!.validate(jsonBody as JsonV);
        if (!validation.valid) {
              throw new Error(createError(validation.errMessage ?? "Data doesn't match expected return type.", reqURI));
        }
    } else {
        throw new Error(createError(`Unsupported Content-Type: ${contentType ?? "missing"}`, reqURI));
    }

    return {
        status: {
            code: req.status,
            text: mapStatus(req.status.toString())
        },
        jsonBody: jsonBody,
        headers: req.headers,
        ok: req.ok
    };
};