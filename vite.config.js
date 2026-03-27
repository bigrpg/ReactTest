var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
var projectRoot = fileURLToPath(new URL('.', import.meta.url));
var jobDir = path.resolve(projectRoot, '.chatgpt-jobs');
function runPythonModule(inputText) {
    var modulePath = fileURLToPath(new URL('./MyPython.py', import.meta.url));
    var pythonCommand = process.platform === 'win32' ? 'pythonw' : 'python';
    return new Promise(function (resolve, reject) {
        var child = spawn(pythonCommand, ['-X', 'utf8', modulePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: __assign(__assign({}, process.env), { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }),
        });
        var stdout = '';
        var stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', function (chunk) {
            stdout += chunk;
        });
        child.stderr.on('data', function (chunk) {
            stderr += chunk;
        });
        child.on('error', reject);
        child.on('close', function (code) {
            if (code !== 0) {
                reject(new Error(stderr.trim() || "Python exited with code ".concat(code)));
                return;
            }
            resolve(stdout.trim());
        });
        child.stdin.end(inputText);
    });
}
function readJobState(jobId) {
    return __awaiter(this, void 0, void 0, function () {
        var jobPath, content, parsed, _a;
        var _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    jobPath = path.resolve(jobDir, "".concat(jobId, ".json"));
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, readFile(jobPath, 'utf8')];
                case 2:
                    content = _e.sent();
                    parsed = JSON.parse(content);
                    return [2 /*return*/, {
                            status: (_b = parsed.status) !== null && _b !== void 0 ? _b : 'pending',
                            result: (_c = parsed.result) !== null && _c !== void 0 ? _c : '',
                            error: (_d = parsed.error) !== null && _d !== void 0 ? _d : '',
                        }];
                case 3:
                    _a = _e.sent();
                    return [2 /*return*/, {
                            status: 'pending',
                            result: '',
                            error: '',
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'python-execution-api',
            configureServer: function (server) {
                var _this = this;
                server.middlewares.use(function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
                    var requestUrl, body_1, jobId, state, error_1, message;
                    var _this = this;
                    var _a, _b;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                requestUrl = new URL((_a = req.url) !== null && _a !== void 0 ? _a : '/', 'http://localhost');
                                if (requestUrl.pathname === '/api/execute') {
                                    if (req.method !== 'POST') {
                                        next();
                                        return [2 /*return*/];
                                    }
                                    body_1 = '';
                                    req.on('data', function (chunk) {
                                        body_1 += chunk;
                                    });
                                    req.on('end', function () { return __awaiter(_this, void 0, void 0, function () {
                                        var parsed, jobId, error_2, message;
                                        var _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _b.trys.push([0, 2, , 3]);
                                                    parsed = JSON.parse(body_1 || '{}');
                                                    return [4 /*yield*/, runPythonModule((_a = parsed.text) !== null && _a !== void 0 ? _a : '')];
                                                case 1:
                                                    jobId = _b.sent();
                                                    sendJson(res, 200, { jobId: jobId });
                                                    return [3 /*break*/, 3];
                                                case 2:
                                                    error_2 = _b.sent();
                                                    message = error_2 instanceof Error ? error_2.message : 'Python execution failed';
                                                    sendJson(res, 500, { error: message });
                                                    return [3 /*break*/, 3];
                                                case 3: return [2 /*return*/];
                                            }
                                        });
                                    }); });
                                    return [2 /*return*/];
                                }
                                if (!(requestUrl.pathname === '/api/result')) return [3 /*break*/, 5];
                                if (req.method !== 'GET') {
                                    next();
                                    return [2 /*return*/];
                                }
                                jobId = (_b = requestUrl.searchParams.get('jobId')) === null || _b === void 0 ? void 0 : _b.trim();
                                if (!jobId) {
                                    sendJson(res, 400, { error: 'Missing jobId' });
                                    return [2 /*return*/];
                                }
                                _c.label = 1;
                            case 1:
                                _c.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, readJobState(jobId)];
                            case 2:
                                state = _c.sent();
                                sendJson(res, 200, state);
                                return [3 /*break*/, 4];
                            case 3:
                                error_1 = _c.sent();
                                message = error_1 instanceof Error ? error_1.message : 'Failed to read job state';
                                sendJson(res, 500, { error: message });
                                return [3 /*break*/, 4];
                            case 4: return [2 /*return*/];
                            case 5:
                                next();
                                return [2 /*return*/];
                        }
                    });
                }); });
            },
        },
    ],
    resolve: {
        alias: {
            '@': path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'src'),
        },
    },
});
