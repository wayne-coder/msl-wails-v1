export namespace main {
	
	export class ActivationResult {
	    success: boolean;
	    reason: string;
	    expiresAt?: number;
	
	    static createFrom(source: any = {}) {
	        return new ActivationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.reason = source["reason"];
	        this.expiresAt = source["expiresAt"];
	    }
	}
	export class DriveTypeInfo {
	    driveType: string;
	    displayName: string;
	    isRemovable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DriveTypeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.driveType = source["driveType"];
	        this.displayName = source["displayName"];
	        this.isRemovable = source["isRemovable"];
	    }
	}
	export class FileStorageResult {
	    success: boolean;
	    data: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new FileStorageResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.data = source["data"];
	        this.error = source["error"];
	    }
	}
	export class LicenseStatus {
	    status: string;
	    message: string;
	    deviceId: string;
	    displayId: string;
	    createdAt?: number;
	    expiresAt?: number;
	    daysLeft?: number;
	    remainingText?: string;
	
	    static createFrom(source: any = {}) {
	        return new LicenseStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.message = source["message"];
	        this.deviceId = source["deviceId"];
	        this.displayId = source["displayId"];
	        this.createdAt = source["createdAt"];
	        this.expiresAt = source["expiresAt"];
	        this.daysLeft = source["daysLeft"];
	        this.remainingText = source["remainingText"];
	    }
	}
	export class RuntimeInfo {
	    name: string;
	    version: string;
	    platform: string;
	    arch: string;
	    dataDir: string;
	    hasRuntime: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RuntimeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.version = source["version"];
	        this.platform = source["platform"];
	        this.arch = source["arch"];
	        this.dataDir = source["dataDir"];
	        this.hasRuntime = source["hasRuntime"];
	    }
	}

}

