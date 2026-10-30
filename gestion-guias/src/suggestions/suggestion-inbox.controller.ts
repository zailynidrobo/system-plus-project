import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { ListSuggestionsQuery } from './dto/list-suggestions.query.js';
import { SuggestionInboxService } from './suggestion-inbox.service.js';

/** HE-05-HU-02 · Bandeja del coordinador. Las rutas fijas van antes de `suggestions/:id`. */
@Controller('academic/suggestions')
@Roles('coordinador')
export class SuggestionInboxController {
  constructor(private readonly inbox: SuggestionInboxService) {}

  @Get()
  list(@Query() query: ListSuggestionsQuery) {
    return this.inbox.list(query);
  }

  @Get('summary')
  summary() {
    return this.inbox.summary();
  }

  @Get('guides')
  guides() {
    return this.inbox.guidesWithSuggestions();
  }

  @Get(':id')
  findForReview(@Param('id') id: string) {
    return this.inbox.findForReview(id);
  }
}
