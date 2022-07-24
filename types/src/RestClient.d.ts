/// <reference types="node" />
export = RestClient;
declare class RestClient {
    constructor(options: RestClientOptions);
    token: string;
    version: number;
    type: string;
    retries: number;
    timeout: number;
    private _agent;
    get(path: RequestOptions["path"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    delete(path: RequestOptions["path"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    post(path: RequestOptions["path"], body: RequestOptions["body"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    patch(path: RequestOptions["path"], body: RequestOptions["body"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    put(path: RequestOptions["path"], body: RequestOptions["body"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    cdn(path: RequestOptions["path"], options?: RequestOptions["options"]): AbortablePromise<RequestResult>;
    request({ path, method, body, headers, options, retries, timeout, cdn }: RequestOptions, _retryCount?: number): AbortablePromise<RequestResult>;
}
declare namespace RestClient {
    export { RestClientOptions, RequestOptions, FileObject, RequestResult, AbortablePromise };
}
type RequestOptions = {
    path: string;
    method: string;
    body?: {
        [key: string]: any;
        files?: FileObject[] | undefined;
    } | Buffer | undefined;
    headers?: import("http").OutgoingHttpHeaders | undefined;
    options?: import("https").RequestOptions | undefined;
    retries?: number | undefined;
    timeout?: number | undefined;
    cdn?: boolean | undefined;
};
type RequestResult = {
    status: import("http").IncomingMessage["statusCode"];
    headers: import("http").IncomingHttpHeaders;
    body: {
        buffer: Buffer;
        readonly text: string;
        readonly json: any;
    };
};
type AbortablePromise<T> = Promise<T> & {
    abort: (reason: string) => void;
};
type RestClientOptions = {
    token: string;
    version?: number;
    type?: "bot" | "bearer";
    retries?: number;
    timeout?: number;
};
type FileObject = {
    name: string;
    data: Buffer | Readable;
    type?: string;
};
import { Readable } from "stream";
