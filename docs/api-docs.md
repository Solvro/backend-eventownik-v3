# API Documentation Standards (Swagger/OpenAPI)

This document defines the unified standards for API documentation in the Eventownik v3 project. Adhering to these standards ensures that our API is easy to consume, well-structured, and consistent across all modules.

---

## 1. Architecture & Setup

We use `@nestjs/swagger` to generate OpenAPI (Swagger) documentation automatically from our NestJS controllers and DTOs.

- **URL**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (local)
- **Config**: Found in `src/config/swagger.config.ts`.
- **Initialization**: Handled in `src/main.ts`.

---

## 2. Controller Standards

Every controller MUST be documented using the following decorators:

### 2.1. Class Level

- `@ApiTags('Category')`: Groups endpoints in the UI. Use plural nouns (e.g., `Participants`, `Events`).
- `@ApiBearerAuth()`: If the controller or specific routes require authentication.
- **Global Errors**: Apply common error decorators (e.g., `@ApiUnauthorizedResponse()`, `@ApiForbiddenResponse()`) at the class level if they apply to all routes within the controller.

### 2.2. Method Level

- `@ApiOperation({ summary: '...', description: '...' })`:
  - `summary`: A concise, one-sentence description of the action.
  - `description`: (Optional) Detailed explanation of the logic, permissions required, or side effects.
- `@ApiOkResponse()`, `@ApiCreatedResponse()`, `@ApiNoContentResponse()`: Use the specific decorator that matches the success status code.
- `@ApiBadRequestResponse()`, `@ApiNotFoundResponse()`, `@ApiConflictResponse()`: Document expected error cases

### 2.3. Parameter Documentation

- `@ApiParam()`: Document path parameters (e.g., `:id`).
- `@ApiQuery()`: Document query parameters (e.g., `?page=1`).

**Example:**

```typescript
@ApiTags('Participants')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Unauthorized access' }) // Applies to all routes below
@Controller('events/:eventId/participants')
export class ParticipantsController {
  @Get(':id')
  @ApiOperation({
    summary: 'Get a participant by UUID',
    description: 'Retrieves a single participant. Requires MANAGE_PARTICIPANT permission.'
  })
  @ApiParam({ name: 'eventId', description: 'UUID of the event' })
  @ApiParam({ name: 'id', description: 'UUID of the participant' })
  @ApiOkResponse({ type: Participant, description: 'The participant record' })
  @ApiNotFoundResponse({ description: 'Participant not found' })
  async show(...) { ... }
}
```

---

## 3. DTO & Entity Standards

DTOs are the primary source for request/response schemas.

### 3.1. Decorators & Swagger CLI Plugin

> **Note:** Ensure the `@nestjs/swagger` CLI plugin is enabled in `nest-cli.json`. This plugin automatically infers types, required/optional status, and default values based on standard TypeScript definitions.
>
> You only need to manually add `@ApiProperty()` or `@ApiPropertyOptional()` when you want to provide explicit `examples`, `descriptions`, or override the auto-inferred schema.

- Use `enum` for properties with a fixed set of values.
- Provide a `description` and `example` for public-facing fields.

### 3.2. DTO Design: Optional vs Nullable

This is a critical distinction for predictability and strict validation:

| Type                    | Syntax                  | Meaning                                               | Decorators                                                                                     |
| :---------------------- | :---------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Required**            | `name: string`          | The key **MUST** be present and have a value.         | `@ApiProperty()`, `@IsString()`                                                                |
| **Optional**            | `name?: string`         | The key **CAN BE OMITTED** from the payload.          | `@ApiPropertyOptional()`, `@IsOptional()`                                                      |
| **Nullable**            | `name: string \| null`  | The key **MUST** be present, but value can be `null`. | `@ApiProperty({ nullable: true })`, `@IsString()`, `@ValidateIf((_, value) => value !== null)` |
| **Optional & Nullable** | `name?: string \| null` | Key can be omitted **OR** present as `null`.          | `@ApiPropertyOptional({ nullable: true })`, `@IsOptional()`                                    |

**Rule of Thumb:**

- **POST (Creation)**: Use **Optional** for fields with defaults. Avoid Nullable unless explicitly required by business logic.
- **PATCH (Update)**: Most fields should be **Optional & Nullable** to allow partial updates or clearing of values.

**Example DTO:**

```typescript
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "Display name of the user",
    example: "John Doe",
    nullable: true,
  })
  @IsString()
  @IsOptional()
  displayName?: string | null; // Optional to allow partial update, nullable to allow clearing
}
```

### 3.3. Update DTOs & PartialType

In NestJS, we often use `PartialType` from `@nestjs/swagger` to create an update DTO from a creation DTO.

- **Benefit**: It automatically inherits all properties and marks them as optional (`?`).
- **Constraint**: It only makes properties **Optional** (`?`), not **Nullable** (`| null`).
- **Standard**:
  - Use `PartialType` when simply making fields optional is enough.
  - If a field needs to be **Nullable** (to clear it) but was **Required** in the base DTO, you must override it in the child class to add `nullable: true`.

**Example:**

```typescript
export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiPropertyOptional({
    description: "New description for the event",
    example: "Updated description",
    nullable: true,
  })
  @IsOptional()
  description?: string | null; // Overriding to allow null, as CreateEventDto required it
}
```

---

## 4. Common Patterns

### 4.1. Pagination Standard

For paginated responses, we use a custom `@ApiPaginatedResponse()` decorator to keep controllers clean while providing accurate Swagger schemas.

**Controller Usage:**

```typescript
@Get()
@ApiPaginatedResponse(Participant)
async findAll(@Query() pageOptionsDto: PageOptionsDto): Promise<PageDto<Participant>> {
  // ...
}
```

### 4.2. File Uploads

Use `@ApiConsumes('multipart/form-data')` and `@ApiBody` with a specific schema for files.

---

## 5. Best Industry Practices

1.  **Be Explicit**: Don't rely on Swagger's auto-inference for complex types or generics.
2.  **Use Examples**: Developers use examples to test endpoints. Ensure they are valid and representative.
3.  **Document Errors**: A good API docs tell you not just how to succeed, but why you failed. Include 401 (Unauthorized) and 403 (Forbidden) if applicable.
4.  **DRY with Mixins & Decorators**: If many endpoints return the same error structure, create a custom decorator (e.g., `@ApiStandardErrors()`).
5.  **Sync with `class-validator`**: Ensure that your `@ApiProperty` settings match your `class-validator` constraints (e.g., `minLength`, `pattern`). Pay special attention to the difference between `@IsOptional()` and `@ValidateIf()` when handling `null` values.
