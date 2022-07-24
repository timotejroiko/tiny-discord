export = IdentifyController;
declare class IdentifyController {
    constructor(options: IdentifyControllerOptions);
    rest: RestClient;
    url: string;
    shards: number;
    shardDelay: number;
    refreshDelay: number;
    lastRefresh: number;
    private _resetPromise;
    private _fetchPromise;
    private _bucket;
    private _gateway;
    get sessions(): SessionLimitsData;
    get nextReset(): number;
    get nextRefresh(): number;
    requestIdentify(id: number, wait?: boolean): Promise<RequestIdentifyResult>;
    refreshSessionLimits(session?: SessionLimitsData | undefined): Promise<void>;
    fetchGateway(force?: boolean): Promise<GatewayData>;
}
declare namespace IdentifyController {
    export { IdentifyControllerOptions, SessionLimitsData, GatewayData, RequestIdentifyResult };
}
import RestClient = require("./RestClient");
type SessionLimitsData = {
    total: number;
    remaining: number;
    reset_after: number;
    max_concurrency: number;
};
type RequestIdentifyResult = {
    canIdentify: boolean;
    retryAfter?: number;
};
type GatewayData = {
    shards: number;
    url: string;
    session_start_limit: SessionLimitsData;
};
type IdentifyControllerOptions = {
    token: string;
    shards?: number;
    rest?: RestClient | Omit<RestClient.RestClientOptions, "token" | "type">;
    shardDelay?: number;
    refreshDelay?: number;
};
