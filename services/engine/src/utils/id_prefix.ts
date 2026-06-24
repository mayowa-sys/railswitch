import { customType } from "drizzle-orm/pg-core";
import crypto from "crypto";



export const prefixedId = (name: string, prefix: string) => 
    customType<{data: string}>({
        dataType(){
            return 'text'
        }
    })(name).$defaultFn(() => `${prefix}_${crypto.randomUUID()}`);