<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReferenceDataService;

class ReferenceDataController extends Controller
{
    public function index()
    {
        return response()->json(app(ReferenceDataService::class)->getAll());
    }
}
