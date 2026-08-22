<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\City;
use App\Models\Language;
use App\Models\Level;
use App\Models\Subject;

class ReferenceDataController extends Controller
{
    public function index()
    {
        return response()->json(app(\App\Services\ReferenceDataService::class)->getAll());
    }
}
