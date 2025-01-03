declare module 'super-json-database' {
    
    interface SnapshotsOptions {
        enabled: boolean;
        folder?: string;
        interval?: number;
    };

    interface DatabaseOptions {
        compress?: boolean;
        cache?: boolean;
        snapshots?: SnapshotsOptions;
    };

    interface DatabaseElement {
        key: string;
        data: unknown;
    };

    export default class SuperJsonDB {
        constructor (filePath?: string, options?: DatabaseOptions);

        public jsonFilePath: string;
        public options: DatabaseOptions;
        public data: Record<string, unknown>;
        public lock: boolean;
        public modifiedKeys: Set<string>;
        public autoSaveInterval: number;
        public compress: boolean;
        public cache: boolean;
        public cachedData: Record<string, unknown>;

        private fetchDataFromFile (): Promise<void>;
        private saveDataToFile (): Promise<void>;
        private autoSave (): void;

        public makeSnapshot (path?: string): void;
        public get (key: string): unknown;
        public set (key: string, value: any): void;
        public has (key: string): boolean;
        public delete (key: string): void;
        public add (key: string, count: number): void;
        public subtract (key: string, count: number): void;
        public push (key: string, element: any): void;
        public clear (): void;
        public all (): DatabaseElement[];

        public on(event: 'save', listener: () => void): this;
        public on(event: 'change', listener: (key: string, value: any) => void): this;
        public on(event: 'delete', listener: (key: string) => void): this;
    }
}