# Porting conventions (Express JS -> NestJS TS)

Goal: identical HTTP behaviour (paths, status codes, JSON bodies, headers) to `backend/` in the original project.
Logic and SQL are copied, not rewritten. Only types and structure change.

## Layout
`src/modules/<domain>/` holds `<name>.model.ts` (data access, @Injectable), `<name>.controller.ts`, `<domain>.module.ts`.
See `src/modules/college/` as the reference.

## Models
- `const XModel = { method(args) {...} }` becomes `@Injectable() export class XModel` with
  `constructor(private readonly database: DatabaseService) {}` and `private get db() { return this.database.db; }`.
- Replace `db.` with `this.db.`. Keep SQL strings byte-identical.
- `clean`, `cleanList`, `Row` come from `src/common/row.ts`.
- Other models used by a model are constructor-injected (export them from their module and import that module).
  For a circular pair use `forwardRef`.
- Module-level helper functions that need `db` become private methods. Pure helpers stay module-level functions.
- Error classes like `ModelError(message, status)` become `StatusError` from `src/common/http-error.ts`.
- Type parameters and return values. Use `Row` for SQL rows, `Record<string, any>` / small interfaces for bodies.
  Do not change runtime behaviour to satisfy the type checker: use `!`, `as`, or `any` instead.

## Controllers
- `@Controller()` with no prefix; full path in the method decorator, e.g. `@Get('families/:id')`.
  The global prefix `/api` is added in main.ts.
- Declare routes in the SAME ORDER as the original routes file (order matters for `/x/preview` vs `/x/:id`).
- Auth: `@UseGuards(StudentGuard | AdminGuard | PatientGuard | HospitalGuard)` from `src/auth/guards.ts`.
  The guards set `req.student`, `req.studentId`, `req.rollNumber`, `req.admin`, `req.adminId`, `req.patient`,
  `req.patientId`, `req.hospitalAdmin`, `req.hospitalId` (typed in `src/auth/request.types.ts`).
  Access verifiers (`verifyMemberAccess` etc.) are on `AuthService`.
- Handlers take `@Req() req: Request` (express) and return the JSON body. The adapter sends it with `res.json(body)`.
- Every `@Post` MUST have `@HttpCode(200)` or `@HttpCode(201)` matching the original (Nest defaults POST to 201).
- Non-2xx: `throw fail(status, message)` for `{ error }` bodies, `throw new HttpError(status, body)` for any other body.
- `try { ... } catch (err) { res.status(500).json({ error: err.message }) }` becomes
  `try { ... } catch (err) { throw serverError(err); }` (serverError passes HttpErrors through).
- Conditional success status (e.g. 200 vs 201 or 403 in the same handler): `@Res({ passthrough: true }) res: Response`
  and `res.status(...)`, then return the body.
- Streams / non-JSON (CSV, PDF): use `@Res() res: Response` and copy the original body verbatim.
- req.params / req.query values are strings, same as Express. Keep the same parsing (parseInt, Number, etc.).
