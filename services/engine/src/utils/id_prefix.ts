import { customType } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";



export const prefixedId = (name: string, prefix: string) => 
    customType<{data: string}>({
        dataType(){
            return 'text'
        }
    })(name).$defaultFn(() => `${prefix}_${nanoid(10)}`);