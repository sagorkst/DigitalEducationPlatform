
$ErrorActionPreference = "Stop"

$BaseUrl = "http://localhost:4000/api"
$SubjectId = "371427e4-3370-4ee2-b062-47fe3695e0ce"
$TopicId = "13da196d-1ae7-4c97-a5d7-bc375fef50a7"
$MathSubjectId = "ff0546f3-af36-4c28-ba38-ca394523b856"
$AlgebraTopicId = "348dec07-8b31-4e06-9095-8598d6b48774"

$Results = @()
$QuestionId = $null
$QuestionCode = $null

function Add-Result {
    param(
        [string]$Name,
        [bool]$Passed,
        [string]$Details
    )

    $script:Results += [PSCustomObject]@{
        Test = $Name
        Result = if ($Passed) { "PASS" } else { "FAIL" }
        Details = $Details
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        $Body = $null
    )

    try {
        $Parameters = @{
            Uri = "$BaseUrl$Path"
            Method = $Method
            ContentType = "application/json"
            ErrorAction = "Stop"
        }

        if ($null -ne $Body) {
            $Parameters.Body = $Body | ConvertTo-Json -Depth 20
        }

        $Response = Invoke-RestMethod @Parameters

        return @{
            Success = $true
            Data = $Response
            Error = ""
            StatusCode = 200
        }
    }
    catch {
        $Message = $_.ErrorDetails.Message

        if (-not $Message) {
            $Message = $_.Exception.Message
        }

        $StatusCode = 0

        if ($_.Exception.Response) {
            try {
                $StatusCode = [int]$_.Exception.Response.StatusCode
            }
            catch {}
        }

        return @{
            Success = $false
            Data = $null
            Error = $Message
            StatusCode = $StatusCode
        }
    }
}

function Test-Rejection {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        $Body,
        [string]$ExpectedMessage
    )

    $Response = Invoke-Api `
        -Method $Method `
        -Path $Path `
        -Body $Body

    $Passed = (
        -not $Response.Success -and
        $Response.Error -like "*$ExpectedMessage*"
    )

    Add-Result `
        -Name $Name `
        -Passed $Passed `
        -Details $(if ($Passed) {
            "Correctly rejected"
        } else {
            $Response.Error
        })
}

function New-QuestionBody {
    param(
        [string]$Text = "Temporary Batch Validation Question"
    )

    return @{
        questionText = $Text
        questionType = "MCQ"
        subject = "English"
        topic = "Noun"
        subjectId = $SubjectId
        topicId = $TopicId
        correctAnswer = "A"
        explanation = "Temporary test explanation."
        difficulty = "EASY"
        status = "DRAFT"
        options = @(
            @{
                label = "A"
                optionText = "Correct Option"
                isCorrect = $true
                sortOrder = 1
            },
            @{
                label = "B"
                optionText = "Wrong Option"
                isCorrect = $false
                sortOrder = 2
            }
        )
        occurrences = @(
            @{
                institution = "Batch Test Organization"
                examName = "Batch Test Exam"
                examYear = 2025
            }
        )
    }
}

try {

    Write-Host "`n========== BATCH QUESTION VALIDATION ==========" -ForegroundColor Cyan

    # ------------------------------------------
    # 1. CREATE TEMPORARY QUESTION
    # ------------------------------------------

    $CreateBody = New-QuestionBody

    $CreateResponse = Invoke-Api `
        -Method "POST" `
        -Path "/questions" `
        -Body $CreateBody

    if (-not $CreateResponse.Success -or
        -not $CreateResponse.Data.data.id) {

        throw "Temporary Question creation failed: $($CreateResponse.Error)"
    }

    $QuestionId = $CreateResponse.Data.data.id
    $QuestionCode = $CreateResponse.Data.data.questionCode

    Add-Result "Create valid MCQ" $true "Created: $QuestionCode"

    Write-Host "`nTemporary Question ID: $QuestionId" -ForegroundColor Yellow

    # ------------------------------------------
    # 2. CREATE VALIDATION TESTS
    # ------------------------------------------

    $Body = New-QuestionBody
    $Body.subjectId = "a1234567-89ab-4cde-8f01-123456789abc"

    Test-Rejection "Create: Non-existing Subject" "POST" "/questions" $Body `
        "Selected Subject does not exist"

    $Body = New-QuestionBody
    $Body.topicId = "a1234567-89ab-4cde-8f01-123456789abc"

    Test-Rejection "Create: Non-existing Topic" "POST" "/questions" $Body `
        "Selected Topic does not exist"

    $Body = New-QuestionBody
    $Body.topic = "Algebra"
    $Body.topicId = $AlgebraTopicId

    Test-Rejection "Create: Subject Topic Mismatch" "POST" "/questions" $Body `
        "Selected Topic must belong to the selected Subject"

    $Body = New-QuestionBody
    $Body.options[1].isCorrect = $true

    Test-Rejection "Create: Multiple Correct Options" "POST" "/questions" $Body `
        "exactly one correct option"

    $Body = New-QuestionBody
    $Body.options[0].isCorrect = $false

    Test-Rejection "Create: No Correct Option" "POST" "/questions" $Body `
        "exactly one correct option"

    $Body = New-QuestionBody
    $Body.options = @($Body.options[0])

    Test-Rejection "Create: Only One Option" "POST" "/questions" $Body `
        "at least 2 elements"

    $Body = New-QuestionBody
    $Body.occurrences[0].examYear = 1800

    Test-Rejection "Create: Invalid Exam Year" "POST" "/questions" $Body `
        "examYear"

    # ------------------------------------------
    # 3. GET QUESTION
    # ------------------------------------------

    $Response = Invoke-Api "GET" "/questions/$QuestionId"

    $Passed = (
        $Response.Success -and
        $Response.Data.data.id -eq $QuestionId
    )

    Add-Result "Get Question by ID" $Passed "Question retrieval"

    # ------------------------------------------
    # 4. UPDATE VALIDATION TESTS
    # ------------------------------------------

    $Body = @{
        subjectId = "a1234567-89ab-4cde-8f01-123456789abc"
    }

    Test-Rejection "Update: Non-existing Subject" "PUT" "/questions/$QuestionId" $Body `
        "Selected Subject does not exist"

    $Body = @{
        subjectId = $SubjectId
        topicId = $AlgebraTopicId
    }

    Test-Rejection "Update: Subject Topic Mismatch" "PUT" "/questions/$QuestionId" $Body `
        "Selected Topic must belong to the selected Subject"

    $Body = @{
        options = @(
            @{
                label = "A"
                optionText = "Option A"
                isCorrect = $true
                sortOrder = 1
            },
            @{
                label = "B"
                optionText = "Option B"
                isCorrect = $true
                sortOrder = 2
            }
        )
    }

    Test-Rejection "Update: Multiple Correct Options" "PUT" "/questions/$QuestionId" $Body `
        "exactly one correct option"

    $Body = @{
        addOccurrences = @(
            @{
                institution = "Test"
                examName = "Invalid Exam"
                examYear = 1800
            }
        )
    }

    Test-Rejection "Update: Invalid Occurrence Year" "PUT" "/questions/$QuestionId" $Body `
        "examYear"

    # ------------------------------------------
    # 5. VALID UPDATE
    # ------------------------------------------

    $Body = @{
        questionText = "Updated Temporary Batch Test Question"
        difficulty = "MEDIUM"
        changeNote = "Batch validation update"
    }

    $Response = Invoke-Api "PUT" "/questions/$QuestionId" $Body

    $Passed = (
        $Response.Success -and
        $Response.Data.data.questionText -eq $Body.questionText
    )

    Add-Result "Update valid question" $Passed "Question update"

    # ------------------------------------------
    # 6. ADD OCCURRENCE
    # ------------------------------------------

    $Body = @{
        addOccurrences = @(
            @{
                institution = "Batch Test Organization 2"
                examName = "Additional Batch Exam"
                examYear = 2024
                questionNumber = 15
                source = "Batch Test"
            }
        )
    }

    $Response = Invoke-Api "PUT" "/questions/$QuestionId" $Body

    $OccurrenceCount = 0

    if ($Response.Success) {
        $OccurrenceCount = $Response.Data.data.occurrences.Count
    }

    $Passed = (
        $Response.Success -and
        $OccurrenceCount -ge 2
    )

    Add-Result "Add additional occurrence" $Passed `
        "Occurrences: $OccurrenceCount"

    # ------------------------------------------
    # 7. EMPTY UPDATE
    # ------------------------------------------

    $Response = Invoke-Api "PUT" "/questions/$QuestionId" @{}

    $Passed = -not $Response.Success

    Add-Result "Empty update rejected" $Passed `
        $(if ($Passed) { "Rejected correctly" } else {
            "API accepted empty update; validation improvement needed"
        })

    # ------------------------------------------
    # 8. HISTORY VERIFICATION
    # ------------------------------------------

    $Response = Invoke-Api "GET" "/questions/$QuestionId/history"

    $VersionCount = 0

    if ($Response.Success) {
        $VersionCount = $Response.Data.totalVersions
    }

    $Passed = (
        $Response.Success -and
        $VersionCount -ge 2
    )

    Add-Result "Question history verification" $Passed `
        "History versions: $VersionCount"

    # ------------------------------------------
    # 9. FINAL DATA INTEGRITY
    # ------------------------------------------

    $Response = Invoke-Api "GET" "/questions/$QuestionId"

    $Passed = $false
    $Details = "Question integrity check failed"

    if ($Response.Success) {

        $Question = $Response.Data.data

        $CorrectCount = @(
            $Question.options | Where-Object { $_.isCorrect -eq $true }
        ).Count

        $Passed = (
            $Question.subjectId -eq $SubjectId -and
            $Question.topicId -eq $TopicId -and
            $CorrectCount -eq 1 -and
            $Question.occurrences.Count -ge 2
        )

        $Details = "Subject, Topic, Options and Occurrences checked"
    }

    Add-Result "Final data integrity" $Passed $Details

}
catch {

    Add-Result "Batch execution" $false $_.Exception.Message

}
finally {

    # ------------------------------------------
    # 10. CLEANUP TEMPORARY QUESTION
    # ------------------------------------------

    if ($QuestionId) {

        Write-Host "`nCleaning temporary Question..." -ForegroundColor Yellow

        $DeleteResponse = Invoke-Api `
            -Method "DELETE" `
            -Path "/questions/$QuestionId"

        Add-Result "Temporary Question soft delete" `
            $DeleteResponse.Success `
            $(if ($DeleteResponse.Success) {
                "Temporary Question moved to Trash"
            } else {
                $DeleteResponse.Error
            })
    }

    # ------------------------------------------
    # FINAL REPORT
    # ------------------------------------------

    Write-Host "`n========== FINAL TEST REPORT ==========" -ForegroundColor Cyan

    $Results | Format-Table -AutoSize -Wrap

    $PassedCount = @(
        $Results | Where-Object { $_.Result -eq "PASS" }
    ).Count

    $FailedCount = @(
        $Results | Where-Object { $_.Result -eq "FAIL" }
    ).Count

    Write-Host "`nTotal Tests : $($Results.Count)" -ForegroundColor White
    Write-Host "PASS        : $PassedCount" -ForegroundColor Green
    Write-Host "FAIL        : $FailedCount" -ForegroundColor Red

    if ($FailedCount -eq 0) {
        Write-Host "`nALL TESTS PASSED!" -ForegroundColor Green
    }
    else {
        Write-Host "`nSOME TESTS NEED ATTENTION." -ForegroundColor Yellow
    }
}
