import { FiscalError } from "../errors"

export class IssuanceError extends FiscalError {
    constructor(code: string, message: string) {
        super(code, message, false)
        this.name = "IssuanceError"
    }
}

export { FiscalError }
