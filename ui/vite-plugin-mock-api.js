var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { MOCK_CONFIG, MOCK_ROWS_BY_ENDPOINT } from "./mock/mockData";
function readBody(req) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        req.on("data", function (c) { return chunks.push(c); });
        req.on("end", function () { return resolve(Buffer.concat(chunks).toString("utf8")); });
        req.on("error", reject);
    });
}
function sendJson(res, data, status) {
    if (status === void 0) { status = 200; }
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(data));
}
function sendEmpty(res, status) {
    res.statusCode = status;
    res.end();
}
export function adminyoMockApiPlugin() {
    return {
        name: "adminyo-mock-api",
        configureServer: function (server) {
            var _this = this;
            server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                var rawUrl, path, ep, qs, page, limit, q_1, basePath, rows, start, slice;
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            rawUrl = (_a = req.url) !== null && _a !== void 0 ? _a : "";
                            path = (_b = rawUrl.split("?")[0]) !== null && _b !== void 0 ? _b : "";
                            if (!path.startsWith("/auth/") &&
                                path !== "/adminyo-config" &&
                                !path.startsWith("/adminyo-proxy/")) {
                                return [2 /*return*/, next()];
                            }
                            if (path === "/auth/me" && req.method === "GET") {
                                sendEmpty(res, 200);
                                return [2 /*return*/];
                            }
                            if (!(path === "/auth/login" && req.method === "POST")) return [3 /*break*/, 2];
                            return [4 /*yield*/, readBody(req)];
                        case 1:
                            _f.sent();
                            sendJson(res, { ok: true });
                            return [2 /*return*/];
                        case 2:
                            if (path === "/auth/logout" && req.method === "POST") {
                                sendEmpty(res, 204);
                                return [2 /*return*/];
                            }
                            if (path === "/adminyo-config" && req.method === "GET") {
                                sendJson(res, MOCK_CONFIG);
                                return [2 /*return*/];
                            }
                            if (path.startsWith("/adminyo-proxy/") && req.method === "GET") {
                                ep = path.slice("/adminyo-proxy/".length);
                                qs = new URLSearchParams(rawUrl.includes("?") ? rawUrl.split("?")[1] : "");
                                page = Math.max(1, Number((_c = qs.get("page")) !== null && _c !== void 0 ? _c : "1") || 1);
                                limit = Math.max(1, Math.min(100, Number((_d = qs.get("limit")) !== null && _d !== void 0 ? _d : "50") || 50));
                                q_1 = ((_e = qs.get("q")) !== null && _e !== void 0 ? _e : "").toLowerCase();
                                basePath = ep.split("?")[0].replace(/^\//, "");
                                rows = MOCK_ROWS_BY_ENDPOINT[basePath];
                                if (!rows) {
                                    sendJson(res, { error: "No mock data for \"".concat(basePath, "\"") }, 404);
                                    return [2 /*return*/];
                                }
                                if (q_1) {
                                    rows = rows.filter(function (row) {
                                        return Object.values(row).some(function (v) { return String(v).toLowerCase().includes(q_1); });
                                    });
                                }
                                start = (page - 1) * limit;
                                slice = rows.slice(start, start + limit);
                                sendJson(res, { items: slice, page: page, limit: limit, total: rows.length });
                                return [2 /*return*/];
                            }
                            next();
                            return [2 /*return*/];
                    }
                });
            }); });
        },
    };
}
